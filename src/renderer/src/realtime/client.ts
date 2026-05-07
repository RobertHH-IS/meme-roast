import { buildMemeUrl } from '../memes/url'
import {
  CATALOG,
  GENERATE_MEME_TOOL,
  HEARTBEAT_INSTRUCTIONS,
  TOOLS,
  buildSystemPrompt,
  type ScanBoundary
} from './prompt'

const REALTIME_BASE = 'https://api.openai.com/v1/realtime/calls'

export type ClientCallbacks = {
  onMeme: (meme: {
    templateId: string
    templateName: string
    captions: string[]
    url: string
  }) => void
  onStateChange: (state: 'connecting' | 'connected' | 'error', error?: string) => void
  onStream?: (stream: MediaStream | null) => void
  onCommit?: () => void
  onLog?: (msg: string) => void
}

export type RealtimeClient = {
  stop: () => void
  triggerScan: (cooldownIds: string[]) => void
  forceMeme: (cooldownIds: string[]) => void
  isConnected: () => boolean
}

type RealtimeEvent = Record<string, unknown> & { type: string }

export async function startRealtime(callbacks: ClientCallbacks): Promise<RealtimeClient> {
  const log = callbacks.onLog ?? (() => {})
  callbacks.onStateChange('connecting')

  const keyResult = await window.api.getEphemeralKey()
  if (!keyResult.ok) {
    callbacks.onStateChange('error', keyResult.error)
    throw new Error(keyResult.error)
  }
  const ephemeralKey = keyResult.value
  log('ephemeral key minted for model: ' + keyResult.session.model)

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  callbacks.onStream?.(stream)
  log(
    'mic stream live: ' +
      stream
        .getAudioTracks()
        .map((t) => `${t.label || 'unnamed'}/${t.readyState}`)
        .join(', ')
  )

  const pc = new RTCPeerConnection()
  for (const track of stream.getTracks()) pc.addTrack(track, stream)

  // Inbound audio track is unused (we requested text-only output) but the API still
  // negotiates one — sink it to a hidden element so the SDP answer is valid.
  pc.addTransceiver('audio', { direction: 'recvonly' })

  const dc = pc.createDataChannel('oai-events')

  const argBuffers = new Map<string, string>()
  const callMeta = new Map<string, { name: string; callId?: string }>()
  const cancelledResponses = new Set<string>()
  const textBuffers = new Map<string, string>()
  const activeResponses = new Set<string>()
  let awaitingResponseCreate = false
  let targetSegment = 1
  let lastMemeSummary: string | undefined

  function getScanBoundary(): ScanBoundary {
    return { segment: targetSegment, lastMemeSummary }
  }

  dc.addEventListener('open', () => {
    log('datachannel open')
    sendEvent(dc, {
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions: buildSystemPrompt([], getScanBoundary()),
        output_modalities: ['text'],
        tools: TOOLS,
        tool_choice: 'required',
        audio: {
          input: {
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 200,
              silence_duration_ms: 200,
              create_response: false,
              interrupt_response: false
            }
          }
        }
      }
    })
    callbacks.onStateChange('connected')
  })

  dc.addEventListener('message', (e) => {
    let event: RealtimeEvent
    try {
      event = JSON.parse(e.data)
    } catch {
      return
    }
    log('← ' + event.type)
    handleEvent(event)
  })

  dc.addEventListener('close', () => log('datachannel closed'))
  dc.addEventListener('error', (e) => log('datachannel error: ' + String(e)))

  function handleEvent(event: RealtimeEvent): void {
    switch (event.type) {
      case 'input_audio_buffer.speech_started':
        log('🎤 speech started')
        break
      case 'input_audio_buffer.speech_stopped':
        log('🎤 speech stopped')
        break
      case 'input_audio_buffer.committed':
        callbacks.onCommit?.()
        break
      case 'response.created':
        awaitingResponseCreate = false
        {
          const responseId = (event.response as { id?: string })?.id
          if (responseId) activeResponses.add(responseId)
          log('  response created: ' + (responseId ?? '?'))
        }
        break
      case 'response.output_item.added': {
        const item = event.item as {
          id?: string
          type?: string
          name?: string
          call_id?: string
        }
        if (item?.type === 'function_call' && item.id) {
          callMeta.set(item.id, { name: item.name ?? '', callId: item.call_id })
          argBuffers.set(item.id, '')
        }
        break
      }
      case 'response.function_call_arguments.delta': {
        const id = event.item_id as string
        const delta = (event.delta as string) ?? ''
        argBuffers.set(id, (argBuffers.get(id) ?? '') + delta)
        break
      }
      case 'response.function_call_arguments.done': {
        const id = event.item_id as string
        const meta = callMeta.get(id)
        const callId = (event.call_id as string) ?? meta?.callId
        const args = argBuffers.get(id) ?? (event.arguments as string) ?? ''
        argBuffers.delete(id)
        callMeta.delete(id)
        if (!callId) {
          log('function_call_arguments.done with no call_id; dropping')
          break
        }
        const toolName = meta?.name ?? GENERATE_MEME_TOOL.name
        try {
          if (toolName === 'no_meme') {
            const parsed = JSON.parse(args) as { reason?: string }
            log('📭 no_meme: ' + (parsed.reason ?? '(no reason)'))
          } else if (toolName === GENERATE_MEME_TOOL.name) {
            const parsed = JSON.parse(args) as {
              template_id: string
              captions: string[]
              reasoning?: string
            }
            const tpl = CATALOG.find((c) => c.id === parsed.template_id)
            if (!tpl) {
              log('unknown template_id: ' + parsed.template_id)
            } else {
              log(
                '🎯 generate_meme: ' +
                  parsed.template_id +
                  ' / ' +
                  JSON.stringify(parsed.captions) +
                  ' / ' +
                  (parsed.reasoning ?? '(no reasoning)')
              )
              callbacks.onMeme({
                templateId: parsed.template_id,
                templateName: tpl.name,
                captions: parsed.captions,
                url: buildMemeUrl(parsed.template_id, parsed.captions)
              })
              lastMemeSummary =
                tpl.id +
                ' / ' +
                JSON.stringify(parsed.captions) +
                ' / ' +
                (parsed.reasoning ?? 'no reasoning')
              targetSegment += 1
              log('  recency boundary advanced to segment ' + targetSegment)
            }
          } else {
            log('unexpected tool: ' + toolName)
          }
          // Scans are intentionally created with conversation: 'none'. The tool call
          // is the app-side result, so there is no conversation item to answer with
          // function_call_output.
        } catch (err) {
          log('failed to parse tool args (' + toolName + '): ' + String(err))
        }
        break
      }
      case 'response.done': {
        // Clean up any orphaned buffers tied to this response.
        const response = event.response as { id?: string; output?: Array<{ id?: string }> } | undefined
        if (response?.id) activeResponses.delete(response.id)
        for (const item of response?.output ?? []) {
          if (item.id) {
            argBuffers.delete(item.id)
            callMeta.delete(item.id)
          }
        }
        break
      }
      case 'response.output_text.delta': {
        const responseId = event.response_id as string
        const delta = (event.delta as string) ?? ''
        textBuffers.set(responseId, (textBuffers.get(responseId) ?? '') + delta)
        // Still try to cancel — sometimes works, often races.
        if (responseId && !cancelledResponses.has(responseId)) {
          cancelledResponses.add(responseId)
          sendEvent(dc, { type: 'response.cancel', response_id: responseId })
        }
        break
      }
      case 'response.output_text.done': {
        const responseId = event.response_id as string
        const fullText = textBuffers.get(responseId) ?? (event.text as string) ?? ''
        textBuffers.delete(responseId)
        log('📝 model said (drift): ' + JSON.stringify(fullText))
        break
      }
      case 'error': {
        const error = event.error as { message?: string } | undefined
        const msg = error?.message ?? JSON.stringify(event)
        if (msg.includes('Cancellation failed')) {
          // Benign race: we tried to cancel a drift response but the model
          // already finished it. The text never reached anything user-facing.
          log('cancel race (ignore): ' + msg)
          break
        }
        awaitingResponseCreate = false
        activeResponses.clear()
        log('server error: ' + msg)
        callbacks.onStateChange('error', msg)
        break
      }
      default:
        break
    }
  }

  pc.addEventListener('connectionstatechange', () => {
    log('pc state: ' + pc.connectionState)
    if (
      pc.connectionState === 'failed' ||
      pc.connectionState === 'disconnected' ||
      pc.connectionState === 'closed'
    ) {
      callbacks.onStateChange('error', `peer connection ${pc.connectionState}`)
    }
  })

  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)

  // Per OpenAI Realtime GA docs: raw SDP body, application/sdp content type.
  // Model is bound to the ephemeral key at /v1/realtime/client_secrets time.
  const sdpRes = await fetch(REALTIME_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ephemeralKey}`,
      'Content-Type': 'application/sdp'
    },
    body: offer.sdp ?? ''
  })

  if (!sdpRes.ok) {
    const body = await sdpRes.text()
    const fullMsg = `SDP exchange failed: ${sdpRes.status} ${sdpRes.statusText}\n${body}`
    console.error('[realtime]', fullMsg)
    callbacks.onStateChange('error', `SDP ${sdpRes.status} — see DevTools console`)
    try {
      dc.close()
    } catch {
      /* noop */
    }
    pc.close()
    stream.getTracks().forEach((t) => t.stop())
    throw new Error(fullMsg)
  }
  log('SDP exchange ok')

  const answerSdp = await sdpRes.text()
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

  return {
    isConnected: () => dc.readyState === 'open',
    triggerScan: (cooldownIds) => {
      if (dc.readyState !== 'open') {
        log('scan skipped: dc not open (' + dc.readyState + ')')
        return
      }
      if (awaitingResponseCreate || activeResponses.size > 0) {
        log('scan skipped: response already in flight')
        return
      }
      log('🔎 scan (cooldowns: ' + (cooldownIds.length || 'none') + ')')
      sendEvent(dc, {
        type: 'session.update',
        session: {
          type: 'realtime',
          instructions: buildSystemPrompt(cooldownIds, getScanBoundary())
        }
      })
      awaitingResponseCreate = true
      sendEvent(dc, {
        type: 'response.create',
        response: {
          conversation: 'none',
          output_modalities: ['text'],
          instructions: HEARTBEAT_INSTRUCTIONS,
          tools: TOOLS,
          tool_choice: 'required'
        }
      })
    },
    forceMeme: (cooldownIds) => {
      if (dc.readyState !== 'open') {
        log('forceMeme skipped: dc not open')
        return
      }
      if (awaitingResponseCreate || activeResponses.size > 0) {
        log('forceMeme skipped: response already in flight')
        return
      }
      log('⚡ force-meme firing')
      sendEvent(dc, {
        type: 'session.update',
        session: {
          type: 'realtime',
          instructions: buildSystemPrompt(cooldownIds, getScanBoundary())
        }
      })
      awaitingResponseCreate = true
      sendEvent(dc, {
        type: 'response.create',
        response: {
          conversation: 'none',
          output_modalities: ['text'],
          instructions:
            'Pick the funniest meme for the most recent thing the user said and call generate_meme. Do NOT call no_meme — you must produce an actual meme.',
          tools: TOOLS,
          tool_choice: { type: 'function', name: 'generate_meme' }
        }
      })
    },
    stop: () => {
      try {
        dc.close()
      } catch {
        /* noop */
      }
      pc.close()
      stream.getTracks().forEach((t) => t.stop())
      callbacks.onStream?.(null)
    }
  }
}

function sendEvent(dc: RTCDataChannel, event: object): void {
  if (dc.readyState !== 'open') return
  const type = (event as { type?: string }).type ?? 'unknown'
  console.log('[realtime] → ' + type)
  dc.send(JSON.stringify(event))
}
