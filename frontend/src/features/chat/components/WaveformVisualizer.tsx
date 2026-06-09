import { useEffect, useRef } from 'react'

// 마이크 녹음 중 음량 파형 시각화
// Whisper는 batch STT라 실시간 텍스트가 없으므로, AnalyserNode의 음량을 파형으로 그려
// "지금 내 말이 들어가고 있다"는 실시간 피드백을 어르신에게 제공한다.
interface WaveformVisualizerProps {
  analyser: AnalyserNode
}

export default function WaveformVisualizer({ analyser }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 시간 영역(waveform) 데이터 버퍼 — fftSize 만큼
    const data = new Uint8Array(analyser.fftSize)
    let rafId = 0

    const render = () => {
      rafId = requestAnimationFrame(render)

      // 레티나 대응: CSS 픽셀 크기에 devicePixelRatio를 곱해 실제 캔버스 해상도 동기화
      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      analyser.getByteTimeDomainData(data)

      // 마이크 테마색(#E8820C)으로 가운데 정렬된 파형 한 줄
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#E8820C'
      ctx.beginPath()
      const sliceWidth = width / data.length
      for (let i = 0; i < data.length; i++) {
        // 128을 중앙(0)으로 정규화 → -1 ~ 1
        const v = data[i] / 128 - 1
        const y = height / 2 + (v * height) / 2
        const x = i * sliceWidth
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    render()

    return () => cancelAnimationFrame(rafId)
  }, [analyser])

  return <canvas ref={canvasRef} className="w-full h-9" aria-label="음성 입력 파형" />
}
