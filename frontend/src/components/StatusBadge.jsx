export default function StatusBadge({ status }) {
  const styles = {
    confirmed: 'badge-confirmed',
    pending: 'badge-pending',
    completed: 'badge-completed',
    cancelled: 'badge-cancelled'
  };

  return (
    <span className={styles[status] || 'badge-pending'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
