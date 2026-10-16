import { describe, expect, it } from 'vitest'

import { formatApplyDeadline, formatSalary } from './format'

describe('format helpers', () => {
  it('formats salary ranges', () => {
    expect(formatSalary(90000, 120000, 'USD')).toBe('$90k–$120k USD')
  })

  it('handles null deadlines', () => {
    expect(formatApplyDeadline(null)).toBeNull()
  })
})
