import type { StaffRole } from '../core/types';

export const STAFF_ROLES: Record<string, StaffRole> = {
  tech: { id: 'tech', name: 'Marco', title: 'Anesthesia Tech', color: '#6a93c9', can: ['fetch', 'restock', 'turnover'] },
  transporter: { id: 'transporter', name: 'Dee', title: 'Transporter', color: '#8e7cc3', can: ['transport'] },
  circulator: { id: 'circulator', name: 'Priya', title: 'Circulating Nurse', color: '#e08aa8', can: ['fetch', 'call'] },
  pacu: { id: 'pacu', name: 'Sam', title: 'PACU Nurse', color: '#4cc38a', can: ['receive'] },
};
