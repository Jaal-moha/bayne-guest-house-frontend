import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Staff {
  id: number;
  name: string;
  role: string;
  phone: string;
  user?: { email: string };
  idCardUrl: string;
}

const StaffManagement: React.FC = () => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const response = await axios.get('/api/staff'); // Adjust API base URL as needed
      setStaffList(response.data);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Staff Management</h2>
      <ul>
        {staffList.map(staff => (
          <li key={staff.id}>
            {staff.name} - {staff.role} - {staff.phone}
            {staff.user && ` (${staff.user.email})`}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StaffManagement;
