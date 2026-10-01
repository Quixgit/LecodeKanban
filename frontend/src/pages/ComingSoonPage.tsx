import { Construction } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, Card, EmptyState } from '@/shared/ui';

export default function ComingSoonPage({ section }: { section: string }) {
  const { t } = useTranslation(['common', 'nav']);
  return (
    <Card className="min-h-[60vh] content-center">
      <EmptyState
        icon={<Construction />}
        title={t('comingSoon.title', { section: t(`nav:pages.${section}.title`) })}
        description={t('comingSoon.description')}
        action={
          <Button asChild variant="secondary">
            <Link to="/ui-kit">{t('comingSoon.openUiKit')}</Link>
          </Button>
        }
      />
    </Card>
  );
}
