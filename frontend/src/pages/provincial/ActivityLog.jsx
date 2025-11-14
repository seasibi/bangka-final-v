import React, { useEffect, useState } from 'react';
import PageTitle from '../../components/PageTitle';

const ActivityLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Replace with your actual API endpoint
    fetch('/api/activity-logs/')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch activity logs');
        return res.json();
      })
      .then((data) => {
        setLogs(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="h-full bg-gray-50">
      <div className="px-4 py-8">
        <PageTitle value="Activity Log" />
      </div>
      <div className="px-4">
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-500">{error}</div>}
        {!loading && !error && (
          <div className="bg-white rounded-xl shadow p-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 px-4">User</th>
                  <th className="text-left py-2 px-4">Action</th>
                  <th className="text-left py-2 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-4">No activity found.</td></tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.logId}>
                      <td className="py-2 px-4">{log.user}</td>
                      <td className="py-2 px-4">{log.action}</td>
                      <td className="py-2 px-4">{new Date(log.timestamp).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLog;
