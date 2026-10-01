import { SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, Card, EmptyState } from '@/shared/ui';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Card className="min-h-[60vh] content-center">
      <EmptyState
        icon={<SearchX />}
        title={t('notFound.title')}
        description={t('notFound.description')}
        action={
          <Button asChild>
            <Link to="/">{t('notFound.back')}</Link>
          </Button>
        }
      />
    </Card>
  );
}
