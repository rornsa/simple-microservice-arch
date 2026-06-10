import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: "/api/payment"
})
export class PaymentGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  afterInit() {
    console.log('WebSocket initialized');
  }

  handleConnection(client: Socket) {
    const studentId = client.handshake.auth.studentId;
    // console.log(`Client connected: ${client.id}, studentId: ${studentId}`);
    if (studentId) {
      client.join(`student:${studentId}`);
    }
  }

  handleDisconnect(client: Socket) {
    // console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() payload: { text: string },
    @ConnectedSocket() client: Socket,
  ): string {
    this.server.emit('message', payload);
    return 'Message received ';
  }


}