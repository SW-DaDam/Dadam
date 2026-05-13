import { useNavigate } from 'react-router'
import { cn } from '@/lib/utils'

const STEPS = [
  { path: '/role-select' },
  { path: '/profile-setup' },
  { path: '/onboarding' },
]

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-center gap-0 py-1">
      {STEPS.map((step, idx) => {
        const stepNum = idx + 1
        const isActive = stepNum === currentStep
        const isDone = stepNum < currentStep

        return (
          <div key={step.path} className="flex items-center">
            {/* 연결선 */}
            {idx > 0 && (
              <div
                className={cn(
                  'w-8 h-0.5',
                  isDone ? 'bg-[#E8820C]' : 'bg-[#E5E7EB]',
                )}
              />
            )}

            {/* 단계 원 — 이전 단계만 클릭 이동 가능 */}
            <button
              type="button"
              onClick={() => isDone && navigate(step.path)}
              disabled={!isDone}
              className={cn(!isDone && 'cursor-default')}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-base font-semibold transition-all',
                  isActive
                    ? 'bg-[#E8820C] text-white'
                    : isDone
                      ? 'bg-[#E8820C] text-white opacity-60'
                      : 'bg-[#F3F4F6] text-[#9CA3AF]',
                )}
              >
                {stepNum}
              </div>
            </button>
          </div>
        )
      })}
    </div>
  )
}
