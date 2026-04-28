import { describe, it, expect } from 'vitest'
import { getAuthErrorMessage, getDbErrorMessage } from './errorMessages'

describe('getAuthErrorMessage', () => {
  it('access_denied 에러는 취소 메시지를 반환한다', () => {
    const error = { code: 'access_denied', message: 'denied' }
    expect(getAuthErrorMessage(error)).toBe('카카오 로그인을 취소하셨어요. 로그인하려면 다시 시도해 주세요.')
  })

  it('server_error 에러는 서버 오류 메시지를 반환한다', () => {
    const error = { code: 'server_error', message: 'error' }
    expect(getAuthErrorMessage(error)).toBe('카카오 서버에 일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.')
  })

  it('unknown 타입 입력도 안전하게 기본 메시지를 반환한다', () => {
    expect(getAuthErrorMessage(null)).toBe('잠시 문제가 생겼어요. 다시 시도해 주세요.')
    expect(getAuthErrorMessage('string error')).toBe('잠시 문제가 생겼어요. 다시 시도해 주세요.')
  })
})

describe('getDbErrorMessage', () => {
  it('23505 에러는 중복 메시지를 반환한다', () => {
    const error = { code: '23505' }
    expect(getDbErrorMessage(error)).toBe('이미 등록된 정보예요.')
  })

  it('알 수 없는 코드는 기본 메시지를 반환한다', () => {
    const error = { code: 'UNKNOWN' }
    expect(getDbErrorMessage(error)).toBe('잠시 문제가 생겼어요. 다시 시도해 주세요.')
  })
})
