'use server';

import { sendOrderReadyNotification } from './notification-service';

/**
 * Notifies a customer that their order is ready for pickup using the centralized NotificationService.
 * (Fire-and-forget).
 * @param orderId The ID of the order that is ready.
 */
export async function notifyOrderReady(orderId: string): Promise<void> {
  try {
    await sendOrderReadyNotification(orderId);
  } catch (error) {
    console.error(`[notifyOrderReady] Error in order ready flow for order ${orderId}:`, error);
  }
}
