import { Archive, Copy, Inbox, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Drawer,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  EmptyState,
  Modal,
  PriorityPill,
  Skeleton,
  TaskStatusPill,
  Tooltip,
  toast,
} from '@/shared/ui';
import { Row, ShowcaseSection } from './ShowcaseSection';

export function OverlaysSection() {
  const { t } = useTranslation('showcase');
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <ShowcaseSection
      id="overlays"
      title={t('overlays.title')}
      description={t('overlays.description')}
    >
      <Row label={t('overlays.surfaces')}>
        <Button variant="secondary" onClick={() => setModalOpen(true)}>
          {t('overlays.openModal')}
        </Button>
        <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
          {t('overlays.openDrawer')}
        </Button>
        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="secondary">{t('overlays.openMenu')}</Button>
          </DropdownTrigger>
          <DropdownContent align="start">
            <DropdownItem>
              <Pencil />
              {t('overlays.menu.edit')}
            </DropdownItem>
            <DropdownItem>
              <Copy />
              {t('overlays.menu.duplicate')}
            </DropdownItem>
            <DropdownItem>
              <Archive />
              {t('overlays.menu.archive')}
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem danger>
              <Trash2 />
              {t('overlays.menu.delete')}
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
        <Tooltip content={t('overlays.tooltipText')}>
          <Button variant="ghost">{t('overlays.hoverMe')}</Button>
        </Tooltip>
      </Row>
      <Row label={t('overlays.toasts')}>
        <Button
          variant="secondary"
          onClick={() =>
            toast.success(t('overlays.toast.successTitle'), t('overlays.toast.successBody'))
          }
        >
          {t('overlays.toast.success')}
        </Button>
        <Button variant="secondary" onClick={() => toast.info(t('overlays.toast.infoTitle'))}>
          {t('overlays.toast.info')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.error(t('overlays.toast.errorTitle'), t('overlays.toast.errorBody'))}
        >
          {t('overlays.toast.error')}
        </Button>
      </Row>
      <Row label={t('overlays.loading')}>
        <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-border-subtle p-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      </Row>
      <Row label={t('overlays.empty')}>
        <div className="w-full rounded-xl border border-dashed border-border">
          <EmptyState
            icon={<Inbox />}
            title={t('overlays.emptyTitle')}
            description={t('overlays.emptyBody')}
            action={<Button size="sm">{t('controls.addTask')}</Button>}
          />
        </div>
      </Row>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={t('overlays.modal.title')}
        description={t('overlays.modal.body')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t('overlays.modal.cancel')}
            </Button>
            <Button variant="danger" onClick={() => setModalOpen(false)}>
              {t('overlays.menu.delete')}
            </Button>
          </>
        }
      />
      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Refactor board ordering to LexoRank"
        description="LK-9712 · Kanban Core"
        footer={
          <Button block onClick={() => setDrawerOpen(false)}>
            {t('overlays.drawer.done')}
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2">
          <TaskStatusPill status="in_progress" />
          <PriorityPill priority="high" />
        </div>
        <p className="mt-5 text-base leading-relaxed text-text-secondary">
          {t('overlays.drawer.body')}
        </p>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </Drawer>
    </ShowcaseSection>
  );
}
