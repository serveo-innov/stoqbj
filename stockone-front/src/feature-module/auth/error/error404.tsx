import React from 'react';
import { Link } from 'react-router-dom';
import { all_routes } from '../../router/all_routes';

const Error500: React.FC = () => (
  <div className="d-flex align-items-center justify-content-center flex-column"
       style={{ minHeight: '100vh', background: '#fff7ed' }}>
    <div className="text-center">
      <div style={{ fontSize: 80, color: '#F97316', fontWeight: 800, lineHeight: 1 }}>500</div>
      <h2 className="mt-3 mb-2" style={{ color: '#1a1a1a' }}>Erreur serveur</h2>
      <p className="text-muted mb-4">Une erreur inattendue s'est produite. Veuillez réessayer.</p>
      <Link to={all_routes.dashboard} className="btn btn-warning text-white px-4">
        <i className="ti ti-home me-2" />
        Retour au tableau de bord
      </Link>
    </div>
  </div>
);

export default Error500;
