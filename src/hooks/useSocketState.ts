import { useSyncExternalStore } from "react";
import { socketService } from "../services/socket.service";

export function useSocketState() {
  return useSyncExternalStore(
    socketService.subscribe,
    socketService.getSnapshot,
  );
}
