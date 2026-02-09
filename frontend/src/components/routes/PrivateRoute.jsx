import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import Spinner from '../common/Spinner';

const PrivateRoute = ({ children, requiredPermissions = [] }) => {
  const { user, loading, hasPermission } = useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    return <Spinner fullPage />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermissions.length > 0 && !hasPermission(requiredPermissions)) {
      return <Navigate to="/access-denied" replace />;
  }


  return children;
};

export default PrivateRoute;