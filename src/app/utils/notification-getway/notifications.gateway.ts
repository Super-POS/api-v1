import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface RegisteredUser {
  clientId: string; // Track clientId to send notifications
  userId: string;   // Track userId for identifying users
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/notifications-getway' })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private registeredUsers: RegisteredUser[] = [];
  handleConnection(client: Socket): void {
  }

  handleDisconnect(client: Socket): void {
    this.registeredUsers = this.registeredUsers.filter(user => user.clientId !== client.id);
  }

  sendOrderNotification(notification: any): void {
    this.server.emit('new-order-notification', notification);
  }

  /** Emits when Baray payment clears (webhook). POS listens and shows a paid success only after this. */
  emitBarayPaymentSuccess(payload: {
    orderId: number;
    receiptNumber: string;
    cashierId: number;
  }): void {
    this.server.emit("baray-payment-success", payload);
  }

  /** Emits when Bakong KHQR payment is confirmed by polling. POS listens to update the order state. */
  emitBakongPaymentSuccess(payload: {
    orderId: number;
    receiptNumber: string;
    cashierId: number;
  }): void {
    this.server.emit("bakong-payment-success", payload);
  }

  /** Emits when ABA PayWay QR payment is confirmed. */
  emitPaywayPaymentSuccess(payload: {
    orderId: number;
    receiptNumber: string;
    cashierId: number;
  }): void {
    this.server.emit("payway-payment-success", payload);
  }

  /** Tell the customer display device to show a KHQR code. */
  emitCustomerDisplayShowKhqr(payload: {
    orderId: number;
    qr: string;
    amount: number;
    currency: "USD" | "KHR";
    expires_at: string;
    merchant_name: string;
    merchant_city: string;
  }): void {
    this.server.emit("customer-display:show-khqr", payload);
  }

  /** Tell the customer display device to show a Baray payment URL as a QR. */
  emitCustomerDisplayShowBaray(payload: {
    orderId: number;
    url: string;
    amount_usd: number;
    expires_at: string;
  }): void {
    this.server.emit("customer-display:show-baray", payload);
  }

  /** Tell the customer display to clear (payment done or cancelled). */
  emitCustomerDisplayClear(payload: { orderId: number }): void {
    this.server.emit("customer-display:clear", payload);
  }

  sendNotificationToUser(userId: string, notification: any): void {
    const user = this.registeredUsers.find(user => user.userId === userId);
    if (user) {
      const client = this.server.sockets.sockets.get(user.clientId);
      if (client) {
        client.emit('notification-update', notification);
      }
    } else {
      console.error(`User with ID ${userId} is not connected.`);
    }
  }
}
