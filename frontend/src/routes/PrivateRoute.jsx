import Loader from "../components/Loader";
import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";

const PrivateRoute = ({ element }) => {
  const { user, loading } = useAuth();
  
  

  if (loading) {
    return <div className="flex items-center justify-center w-full h-90">
    <Loader />
  </div>
  }

  return user ? element : <Navigate to="/" replace />;
};
export default PrivateRoute;