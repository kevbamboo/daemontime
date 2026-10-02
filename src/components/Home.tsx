import { lazy, Suspense } from "react";
import AuthModal from "./AuthModal";
const GameBox = lazy(() => import("./GameBox"));
export default function Home({ authenticated }: { authenticated: boolean }) {
  return authenticated ? (
    <Suspense fallback={<p role="status">Loading lobby...</p>}>
      <GameBox />
    </Suspense>
  ) : (
    <AuthModal />
  );
}
