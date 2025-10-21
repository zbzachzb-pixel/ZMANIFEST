// src/app/api/send-push/route.ts
// API route to send push notifications via Expo Push API (CORS workaround)

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { token, title, body, data } = await request.json()

    // Validate required fields
    if (!token || !title || !body) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: token, title, body' },
        { status: 400 }
      )
    }

    // Call Expo Push API from server-side (no CORS issues)
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: token,
        sound: 'default',
        title: title,
        body: body,
        data: data || {},
        priority: 'high'
      })
    })

    const result = await response.json()
    console.log('Push notification result:', result)

    if (result.data?.status === 'ok') {
      return NextResponse.json({ success: true, data: result.data })
    } else {
      return NextResponse.json(
        { success: false, error: result },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Push notification error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
