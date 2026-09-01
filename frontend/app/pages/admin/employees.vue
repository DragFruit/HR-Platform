<template>
  <section class="card section-card personnel-admin">
    <div class="section-head row personnel-admin__head">
      <div class="personnel-admin__status">
        <p v-if="saveStatus === 'saving'" class="save-hint muted">Сохранение…</p>
        <p v-else-if="saveStatus === 'saved'" class="save-hint muted">Сохранено</p>
        <p v-else-if="saveStatus === 'error'" class="save-hint save-hint--error">
          Ошибка: {{ saveError }}
        </p>
      </div>
      <button class="button primary" type="button" :disabled="reloadLoading" @click="addEmployee">
        + Сотрудник
      </button>
    </div>

    <p v-if="reloadLoading" class="muted state-box">Загрузка с сервера…</p>

    <article v-else-if="employees.length === 0" class="state-box onboarding-box">
      <h3>Справочник пуст — это нормально</h3>
      <ol class="onboarding-steps">
        <li>Нажмите «+ Сотрудник» и заполните ФИО, отдел, дату выхода.</li>
        <li>В колонке «Руководитель» выберите менеджера из списка — по этому пути идут согласования отпусков.</li>
      </ol>
      <p class="soft">Переключатель «Сотрудник / Администратор» в сайдбаре — для просмотра графика и настройки справочника.</p>
    </article>

    <div v-else class="personnel-table-wrap">
      <table class="table personnel-table">
        <colgroup>
          <col class="col-avatar" />
          <col class="col-bitrix" />
          <col class="col-name" />
          <col class="col-title" />
          <col class="col-dept" />
          <col class="col-legal" />
          <col class="col-contract" />
          <col class="col-manager" />
          <col class="col-date" />
          <col class="col-role" />
          <col class="col-key" />
          <col class="col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th class="col-avatar" aria-label="Аватар" />
            <th class="col-bitrix" title="ID пользователя в Bitrix24">Bitrix ID</th>
            <th class="col-name">ФИО</th>
            <th class="col-title">Должность</th>
            <th class="col-dept">Отдел</th>
            <th class="col-legal">Юр. лицо</th>
            <th class="col-contract">Договор</th>
            <th class="col-manager">Руководитель</th>
            <th class="col-date">Дата приёма</th>
            <th class="col-role">Роль</th>
            <th class="col-key" aria-label="Vibe" />
            <th class="col-actions" aria-label="Действия" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="emp in employees" :key="emp.id">
            <td class="col-avatar">
              <UserAvatar
                :user-id="emp.platform_user_id ?? emp.bitrix_user_id"
                :name="emp.name"
                :size="28"
              />
            </td>
            <td class="col-bitrix">
              <input
                :value="emp.bitrix_user_id ?? ''"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                class="table-input table-input--bitrix"
                placeholder="ID"
                autocomplete="off"
                :aria-label="`Bitrix ID — ${emp.name || 'сотрудник'}`"
                @input="onBitrixIdInput(emp.id, $event)"
                @blur="onBitrixIdBlur(emp.id, $event)"
              />
            </td>
            <td class="col-name">
              <textarea
                :value="emp.name"
                class="table-input table-textarea"
                rows="2"
                placeholder="ФИО"
                @input="onFieldInput(emp.id, 'name', $event)"
                @blur="onFieldBlur(emp.id, 'name', $event)"
              />
            </td>
            <td class="col-title">
              <textarea
                :value="emp.title"
                class="table-input table-textarea"
                rows="2"
                placeholder="Должность"
                @input="onFieldInput(emp.id, 'title', $event)"
                @blur="onFieldBlur(emp.id, 'title', $event)"
              />
            </td>
            <td class="col-dept">
              <select
                :value="emp.department"
                class="table-input table-input--select"
                @change="updateField(emp.id, 'department', ($event.target as HTMLSelectElement).value)"
              >
                <option value="">—</option>
                <option
                  v-if="emp.department && !departmentOptions.includes(emp.department)"
                  :value="emp.department"
                >
                  {{ emp.department }}
                </option>
                <option v-for="dep in departmentOptions" :key="dep" :value="dep">{{ dep }}</option>
              </select>
            </td>
            <td class="col-legal">
              <input
                :value="emp.legal_entity"
                type="text"
                class="table-input table-input--compact"
                placeholder="Юр. лицо"
                :aria-label="`Юр. лицо — ${emp.name || 'сотрудник'}`"
                @input="onFieldInput(emp.id, 'legal_entity', $event)"
                @blur="onFieldBlur(emp.id, 'legal_entity', $event)"
              />
            </td>
            <td class="col-contract">
              <input
                :value="emp.contract_form"
                type="text"
                class="table-input table-input--compact"
                placeholder="ТД, ГПХ…"
                :aria-label="`Договор — ${emp.name || 'сотрудник'}`"
                @input="onFieldInput(emp.id, 'contract_form', $event)"
                @blur="onFieldBlur(emp.id, 'contract_form', $event)"
              />
            </td>
            <td class="col-manager" @paste.capture="onManagerPaste(emp.id, $event)">
              <select
                :value="emp.manager"
                class="table-input table-input--select"
                @change="updateField(emp.id, 'manager', ($event.target as HTMLSelectElement).value)"
              >
                <option value="">—</option>
                <option
                  v-if="emp.manager && !managerOptions.includes(emp.manager)"
                  :value="emp.manager"
                >
                  {{ emp.manager }} (устаревшее)
                </option>
                <option v-for="name in managerOptions" :key="name" :value="name">{{ name }}</option>
              </select>
            </td>
            <td class="col-date">
              <input
                :value="emp.hired_at"
                type="date"
                class="table-input table-input--date"
                @input="onFieldInput(emp.id, 'hired_at', $event)"
                @blur="onFieldBlur(emp.id, 'hired_at', $event)"
              />
            </td>
            <td class="col-role">
              <select
                :value="emp.account_role"
                class="table-input table-input--select"
                @change="
                  updateField(
                    emp.id,
                    'account_role',
                    ($event.target as HTMLSelectElement).value as AccountRole
                  )
                "
              >
                <option value="">—</option>
                <option v-for="(label, key) in roleLabels" :key="key" :value="key">
                  {{ label }}
                </option>
              </select>
            </td>
            <td class="col-key">
              <button
                class="personnel-password-btn"
                type="button"
                title="Логин и пароль Vibe"
                @click="openVibeCredentials(emp)"
              >
                🔑
              </button>
            </td>
            <td class="col-actions">
              <button
                v-if="emp.account_role !== 'admin'"
                class="personnel-delete-btn"
                type="button"
                aria-label="Удалить сотрудника"
                title="Удалить"
                @click="onRemoveEmployee(emp)"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                  <path
                    d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M10 11v6M14 11v6"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <VibeCredentialsDialog
    v-model:open="vibeCredsOpen"
    :employee="vibeCredsEmployee"
    @saved="onVibeCredsSaved"
  />
</template>

<script setup lang="ts">
import type { AccountRole, Employee } from '~/composables/useEmployees';
import { roleLabels } from '~/composables/usePermissions';
import { resolveManagerFromList } from '~/utils/employeeName';

const DEBOUNCE_MS = 400;

const {
  employees,
  managerOptions,
  departmentOptions,
  updateEmployee,
  addEmployee,
  removeEmployee,
  reloadFromServer,
  saveStatus,
  saveError,
  reloadLoading
} = useEmployees();

const onRemoveEmployee = async (emp: Employee) => {
  const label = emp.name.trim() || `id ${emp.id}`;
  if (!window.confirm(`Удалить «${label}» из справочника насовсем?`)) return;
  const result = await removeEmployee(emp.id);
  if (!result.ok) {
    window.alert(result.error || 'Не удалось удалить на сервере');
  }
};

const vibeCredsOpen = ref(false);
const vibeCredsEmployee = ref<Employee | null>(null);

const openVibeCredentials = (emp: Employee) => {
  vibeCredsEmployee.value = emp;
  vibeCredsOpen.value = true;
};

const onVibeCredsSaved = () => {
  window.alert('Учётные данные Vibe сохранены. Сотрудник входит по email и паролю.');
};

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

const fieldKey = (id: number, field: keyof Employee) => `${id}:${field}`;

const fieldValue = (event: Event) =>
  (event.target as HTMLInputElement | HTMLTextAreaElement).value;

const updateField = (id: number, field: keyof Employee, value: string) => {
  updateEmployee(id, { [field]: value } as Partial<Employee>);
};

const parseBitrixUserId = (raw: string): number | null | 'invalid' => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return 'invalid';
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n) || n <= 0) return 'invalid';
  return n;
};

const updateBitrixUserId = (id: number, raw: string) => {
  const parsed = parseBitrixUserId(raw);
  if (parsed === 'invalid') {
    saveStatus.value = 'error';
    saveError.value = 'Bitrix ID — целое положительное число';
    return;
  }
  updateEmployee(id, { bitrix_user_id: parsed });
};

const immediateUpdate = (id: number, field: keyof Employee, value: string) => {
  const key = fieldKey(id, field);
  const pending = debounceTimers.get(key);
  if (pending) {
    clearTimeout(pending);
    debounceTimers.delete(key);
  }
  updateField(id, field, value);
};

const debouncedUpdate = (id: number, field: keyof Employee, value: string) => {
  const key = fieldKey(id, field);
  const pending = debounceTimers.get(key);
  if (pending) clearTimeout(pending);
  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key);
      updateField(id, field, value);
    }, DEBOUNCE_MS)
  );
};

const onFieldInput = (id: number, field: keyof Employee, event: Event) => {
  debouncedUpdate(id, field, fieldValue(event));
};

const onFieldBlur = (id: number, field: keyof Employee, event: Event) => {
  immediateUpdate(id, field, fieldValue(event));
};

const onBitrixIdInput = (id: number, event: Event) => {
  const key = fieldKey(id, 'bitrix_user_id');
  const pending = debounceTimers.get(key);
  if (pending) clearTimeout(pending);
  const raw = fieldValue(event);
  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key);
      updateBitrixUserId(id, raw);
    }, DEBOUNCE_MS)
  );
};

const onBitrixIdBlur = (id: number, event: Event) => {
  const key = fieldKey(id, 'bitrix_user_id');
  const pending = debounceTimers.get(key);
  if (pending) {
    clearTimeout(pending);
    debounceTimers.delete(key);
  }
  updateBitrixUserId(id, fieldValue(event));
};

const onManagerPaste = (empId: number, event: ClipboardEvent) => {
  const text = event.clipboardData?.getData('text') ?? '';
  const lines = text
    .split(/\r?\n|\t/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return;

  event.preventDefault();
  const options = managerOptions.value;
  const startIndex = employees.value.findIndex((emp) => emp.id === empId);
  if (startIndex < 0) return;

  let skipped = 0;
  for (let i = 0; i < lines.length; i++) {
    const emp = employees.value[startIndex + i];
    if (!emp) break;
    const resolved = resolveManagerFromList(lines[i]!, options);
    if (resolved === null) {
      skipped++;
      continue;
    }
    updateField(emp.id, 'manager', resolved);
  }

  if (skipped > 0) {
    saveStatus.value = 'error';
    saveError.value = `${skipped} строк не совпали со списком руководителей — выберите вручную`;
  }
};

onMounted(() => {
  reloadFromServer();
});
</script>

<style scoped>
.personnel-admin__head {
  align-items: flex-start;
  margin-bottom: 4px;
}

.personnel-admin__status {
  min-height: 1.25rem;
  flex: 1;
}

.save-hint {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
}

.save-hint--error {
  color: var(--danger, #c0392b);
}

.personnel-delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted, #888);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.personnel-password-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 0.95rem;
  line-height: 1;
}

.personnel-password-btn:hover {
  background: rgba(116, 81, 244, 0.12);
}

.col-actions {
  white-space: nowrap;
}

.personnel-delete-btn:hover {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
}

.personnel-delete-btn:focus-visible {
  outline: 2px solid #dc2626;
  outline-offset: 2px;
}
</style>
