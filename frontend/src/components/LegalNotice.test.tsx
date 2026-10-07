import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { TermsGate } from './LegalNotice'

describe('TermsGate', () => {
  beforeEach(() => localStorage.clear())

  it('only closes after confirming age and accepting, and remembers it', async () => {
    const { unmount } = render(<TermsGate />)
    const button = screen.getByRole('button', { name: 'Aceitar e continuar' })
    expect(button).toBeDisabled()
    await userEvent.click(screen.getByLabelText(/18 anos ou mais/))
    expect(button).toBeDisabled()
    await userEvent.click(screen.getByLabelText(/Li e aceito/))
    await userEvent.click(button)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()
    render(<TermsGate />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
