import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { pendingChangesRepo } from '@/lib/db'

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: admin session required' },
        { status: 401 },
      )
    }

    const { id } = await props.params
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Change ID is required' },
        { status: 400 },
      )
    }

    await pendingChangesRepo.retryPendingChange(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error retrying pending change:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
