import React from 'react';
import MFASetup from '../../components/auth/MFASetup';

const ProfileMFA = () => {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Bảo mật (MFA)</h2>
            <MFASetup />
        </div>
    );
};

export default ProfileMFA;
