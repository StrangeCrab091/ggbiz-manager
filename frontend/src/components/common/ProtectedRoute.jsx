import { Outlet, useOutletContext } from 'react-router-dom';

export default function ProtectedRoute() {
  const context = useOutletContext();
  return <Outlet context={context} />;
}
