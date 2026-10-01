import {
  CalendarDays,
  Columns3,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  Field,
  IconButton,
  Input,
  Kbd,
  SegmentedControl,
  Select,
  Switch,
} from '@/shared/ui';
import { Row, ShowcaseSection } from './ShowcaseSection';

type TaskView = 'list' | 'kanban' | 'calendar';
type ProjectView = 'list' | 'card';

export function ControlsSection() {
  const { t } = useTranslation('showcase');
  const [view, setView] = useState<TaskView>('kanban');
  const [projectView, setProjectView] = useState<ProjectView>('card');
  const [status, setStatus] = useState<string>();
  const [checked, setChecked] = useState(true);
  const [notify, setNotify] = useState(true);
  const [email, setEmail] = useState('peter@');

  return (
    <ShowcaseSection
      id="controls"
      title={t('controls.title')}
      description={t('controls.description')}
    >
      <Row label={t('controls.buttons')}>
        <Button>
          <Plus />
          {t('controls.addTask')}
        </Button>
        <Button variant="secondary">
          <SlidersHorizontal />
          {t('controls.filter')}
        </Button>
        <Button variant="secondary">
          <Upload />
          {t('controls.export')}
        </Button>
        <Button variant="outline">{t('controls.editProject')}</Button>
        <Button variant="soft">{t('controls.soft')}</Button>
        <Button variant="ghost">{t('controls.ghost')}</Button>
        <Button variant="danger">{t('controls.delete')}</Button>
        <Button loading>{t('controls.saving')}</Button>
        <Button disabled>{t('controls.disabled')}</Button>
        <Button variant="outline" disabled>
          {t('controls.editProject')}
        </Button>
      </Row>
      <Row label={t('controls.sizes')}>
        <Button size="sm">{t('controls.small')}</Button>
        <Button size="md">{t('controls.medium')}</Button>
        <Button size="lg">{t('controls.large')}</Button>
        <IconButton label={t('controls.more')} size="sm">
          <span className="text-base leading-none">•••</span>
        </IconButton>
        <IconButton label={t('controls.add')}>
          <Plus />
        </IconButton>
        <IconButton label={t('controls.add')} variant="ghost">
          <Plus />
        </IconButton>
      </Row>
      <Row label={t('controls.segmented')}>
        <SegmentedControl<TaskView>
          label={t('controls.viewLabel')}
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: t('controls.views.list'), icon: <List /> },
            { value: 'kanban', label: t('controls.views.kanban'), icon: <Columns3 /> },
            { value: 'calendar', label: t('controls.views.calendar'), icon: <CalendarDays /> },
          ]}
        />
        <SegmentedControl<ProjectView>
          label={t('controls.viewLabel')}
          value={projectView}
          onChange={setProjectView}
          options={[
            { value: 'list', label: t('controls.views.list'), icon: <List /> },
            { value: 'card', label: t('controls.views.card'), icon: <LayoutGrid /> },
          ]}
        />
      </Row>
      <Row label={t('controls.inputs')}>
        <Input
          wrapperClassName="w-80"
          leadingIcon={<Search />}
          placeholder={t('controls.searchTask')}
          aria-label={t('controls.searchTask')}
          trailing={<Kbd>/</Kbd>}
        />
        <Select
          label={t('controls.status')}
          placeholder={t('controls.status')}
          value={status}
          onValueChange={setStatus}
          options={['todo', 'in_progress', 'in_review', 'done'].map((s) => ({
            value: s,
            label: t(`common:status.${s}`),
          }))}
        />
        <Select
          label={t('controls.period')}
          prefix={t('controls.period')}
          value="2025-05"
          options={[{ value: '2025-05', label: t('controls.periodValue') }]}
        />
      </Row>
      <Row label={t('controls.forms')}>
        <Field
          label={t('controls.email')}
          error={email.includes('.') ? undefined : t('controls.emailError')}
          className="w-80"
        >
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </Field>
        <Field label={t('controls.name')} hint={t('controls.nameHint')} className="w-80">
          <Input defaultValue="Peter Gabrielle" />
        </Field>
      </Row>
      <Row label={t('controls.toggles')}>
        <label className="flex items-center gap-2 text-base text-text">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
          {t('controls.checkbox')}
        </label>
        <label className="flex items-center gap-2 text-base text-text">
          <Checkbox checked="indeterminate" />
          {t('controls.indeterminate')}
        </label>
        <label className="flex items-center gap-2 text-base text-text">
          <Switch checked={notify} onCheckedChange={setNotify} />
          {t('controls.switch')}
        </label>
      </Row>
    </ShowcaseSection>
  );
}
