import { useState, useRef, useCallback, useEffect } from 'react'
import { invoices } from '../services/api.js'

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: '16px',
  },
  modal: {
    width: '100%', maxWidth: '480px',
    background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)', overflow: 'hidden',
    boxShadow: 'var(--shadow-accent)',
  },
  header: {
    padding: '18px 20px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontWeight: '600', fontSize: '16px' },
  closeBtn: {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    color: 'var(--text-muted)', borderRadius: '8px', padding: '6px 10px', fontSize: '13px',
  },
  body: { padding: '20px' },
  viewfinder: {
    position: 'relative', borderRadius: '12px', overflow: 'hidden',
    background: '#000', aspectRatio: '4/3', marginBottom: '16px',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  canvas: { display: 'none' },
  scanLine: {
    position: 'absolute', left: '8px', right: '8px', height: '2px',
    background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
    animation: 'scanLine 2s ease-in-out infinite',
    borderRadius: '1px',
  },
  corners: {
    position: 'absolute', inset: '8px', pointerEvents: 'none',
    border: '2px solid transparent',
  },
  corner: (pos) => {
    const base = { position: 'absolute', width: '20px', height: '20px', border: '2px solid var(--accent)' }
    const positions = {
      tl: { top: 0, left: 0, borderRight: 'none', borderBottom: 'none', borderTopLeftRadius: '4px' },
      tr: { top: 0, right: 0, borderLeft: 'none', borderBottom: 'none', borderTopRightRadius: '4px' },
      bl: { bottom: 0, left: 0, borderRight: 'none', borderTop: 'none', borderBottomLeftRadius: '4px' },
      br: { bottom: 0, right: 0, borderLeft: 'none', borderTop: 'none', borderBottomRightRadius: '4px' },
    }
    return { ...base, ...positions[pos] }
  },
  preview: { width: '100%', borderRadius: '12px', marginBottom: '16px', display: 'block' },
  actions: { display: 'flex', gap: '10px' },
  btnPrimary: {
    flex: 1, padding: '13px', background: 'var(--accent)', color: '#fff',
    borderRadius: '10px', fontSize: '15px', fontWeight: '600',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  },
  btnSecondary: {
    flex: 1, padding: '13px', background: 'var(--bg-elevated)',
    color: 'var(--text)', borderRadius: '10px', fontSize: '15px', fontWeight: '500',
    border: '1px solid var(--border)',
  },
  progress: {
    marginTop: '16px', background: 'var(--bg)', borderRadius: '8px', height: '6px', overflow: 'hidden',
  },
  progressBar: (pct) => ({
    height: '100%', background: 'var(--accent)',
    borderRadius: '8px', width: `${pct}%`, transition: 'width 0.3s',
  }),
  status: { fontSize: '13px', color: 'var(--text-muted)', marginTop: '10px', textAlign: 'center' },
  uploadZone: {
    border: '2px dashed var(--border)', borderRadius: '12px', padding: '32px',
    textAlign: 'center', marginBottom: '16px', cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  uploadIcon: { fontSize: '32px', marginBottom: '8px' },
  uploadText: { color: 'var(--text-muted)', fontSize: '14px' },
}

export default function CameraCapture({ onClose, onUploaded }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)

  const [phase, setPhase] = useState('idle') // idle | camera | preview | uploading | done
  const [sourceMode, setSourceMode] = useState(null) // 'camera' | 'file'
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [capturedURL, setCapturedURL] = useState(null)
  const [progress, setProgress] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState('')

  // Assign stream to video element once the camera phase renders the <video>
  useEffect(() => {
    if (phase === 'camera' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [phase])

  const startCamera = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = stream
      setSourceMode('camera')
      setPhase('camera') // render <video> first, then useEffect sets srcObject
    } catch (e) {
      setError(`No se pudo acceder a la cámara: ${e.message || 'Verifica los permisos del navegador.'}`)
    }
  }

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const capture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      setCapturedBlob(blob)
      setCapturedURL(URL.createObjectURL(blob))
      stopCamera()
      setPhase('preview')
    }, 'image/jpeg', 0.92)
  }

  const retake = () => {
    URL.revokeObjectURL(capturedURL)
    setCapturedBlob(null)
    setCapturedURL(null)
    if (sourceMode === 'camera') {
      startCamera()
    } else {
      setPhase('idle')
    }
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCapturedBlob(file)
    setCapturedURL(URL.createObjectURL(file))
    setSourceMode('file')
    setPhase('preview')
  }

  const upload = async () => {
    if (!capturedBlob) return
    setPhase('uploading')
    setProgress(0)
    setStatusMsg('Subiendo imagen...')

    const fd = new FormData()
    fd.append('invoice', capturedBlob, 'invoice.jpg')

    try {
      setStatusMsg('Extrayendo datos con Document AI...')
      const { data } = await invoices.upload(fd, (pct) => {
        setProgress(pct)
        if (pct === 100) setStatusMsg('Analizando con Gemini...')
      })
      setStatusMsg('¡Factura procesada exitosamente!')
      setPhase('done')
      setTimeout(() => { onUploaded(data.invoice); onClose() }, 1200)
    } catch (err) {
      setError(err.response?.data?.message || 'Error al procesar la factura.')
      setPhase('preview')
    }
  }

  const close = () => {
    stopCamera()
    URL.revokeObjectURL(capturedURL)
    onClose()
  }

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && close()}>
      <div style={s.modal} className="fade-in">
        <div style={s.header}>
          <span style={s.title}>Capturar factura</span>
          <button style={s.closeBtn} onClick={close}>✕ Cerrar</button>
        </div>

        <div style={s.body}>
          {phase === 'idle' && (
            <>
              <div style={s.uploadZone} onClick={() => fileRef.current.click()}>
                <div style={s.uploadIcon}>📁</div>
                <div style={s.uploadText}>Toca para cargar una imagen desde el dispositivo</div>
              </div>
              <div style={{ ...s.actions, flexDirection: 'column' }}>
                <button style={s.btnPrimary} onClick={startCamera}>📷 Abrir cámara</button>
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFile} />
            </>
          )}

          {phase === 'camera' && (
            <>
              <div style={s.viewfinder}>
                <video ref={videoRef} style={s.video} autoPlay playsInline muted />
                <div style={s.scanLine} />
                {['tl', 'tr', 'bl', 'br'].map((p) => <div key={p} style={s.corner(p)} />)}
                <canvas ref={canvasRef} style={s.canvas} />
              </div>
              <div style={s.actions}>
                <button style={s.btnSecondary} onClick={() => { stopCamera(); setPhase('idle') }}>Cancelar</button>
                <button style={s.btnPrimary} onClick={capture}>📸 Capturar</button>
              </div>
            </>
          )}

          {phase === 'preview' && (
            <>
              <img src={capturedURL} style={s.preview} alt="Vista previa de la factura" />
              {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
              <div style={s.actions}>
                <button style={s.btnSecondary} onClick={retake}>🔄 Retomar</button>
                <button style={s.btnPrimary} onClick={upload}>✨ Procesar con IA</button>
              </div>
            </>
          )}

          {phase === 'uploading' && (
            <>
              <img src={capturedURL} style={{ ...s.preview, opacity: 0.6 }} alt="Procesando..." />
              <div style={s.progress}><div style={s.progressBar(progress)} /></div>
              <p style={s.status}>{statusMsg}</p>
            </>
          )}

          {phase === 'done' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <p style={{ fontWeight: '600', marginBottom: '6px' }}>Factura digitalizada</p>
              <p style={s.status}>Redirigiendo...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
