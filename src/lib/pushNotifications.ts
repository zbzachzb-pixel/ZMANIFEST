// src/lib/pushNotifications.ts
export async function sendPushNotification(token: string, title: string, body: string) {
  try {
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
        priority: 'high'
      })
    })

    const result = await response.json()
    console.log('Push notification result:', result)
    return result.data?.status === 'ok'
  } catch (error) {
    console.error('Failed to send push notification:', error)
    return false
  }
}
