// src/lib/pushNotifications.ts
// Client-side push notification service (calls API route to avoid CORS)

export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: any
): Promise<boolean> {
  try {
    // Call our API route instead of Expo directly (avoids CORS issues)
    const response = await fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token,
        title,
        body,
        data
      })
    })

    const result = await response.json()
    console.log('✅ Push notification sent:', result)
    return result.success
  } catch (error) {
    console.error('❌ Failed to send push notification:', error)
    return false
  }
}
