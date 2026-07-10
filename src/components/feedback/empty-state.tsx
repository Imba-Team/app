import { Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { StatusScreen } from './status-screen';

interface Props {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon = Inbox, action }: Props) {
  return <StatusScreen title={title} description={description} icon={icon} action={action} />;
}
