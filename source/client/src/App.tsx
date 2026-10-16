import { useSession } from './state/session';
import { useHashRoute } from './router';
import { Login } from './pages/Login';
import { Shell } from './ui/Shell';
import { Overview } from './pages/Overview';
import { WorkOrders } from './pages/WorkOrders';
import { WorkOrderView } from './pages/WorkOrderView';
import { About } from './pages/About';

export function App() {
  const { token } = useSession();
  const [route, navigate] = useHashRoute();
  if (!token) return <Login />;
  const m = route.match(/^\/orders\/(.+)$/);
  let page;
  if (m) page = <WorkOrderView id={decodeURIComponent(m[1])} onBack={() => navigate('/orders')} />;
  else if (route.startsWith('/orders')) page = <WorkOrders onOpen={(id) => navigate('/orders/' + encodeURIComponent(id))} />;
  else if (route.startsWith('/about')) page = <About />;
  else page = <Overview onOpenOrders={() => navigate('/orders')} />;
  return <Shell route={route} navigate={navigate}>{page}</Shell>;
}
