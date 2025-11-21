export type AudioNotificationId =
  | 'system_ready'
  | 'cycle_start'
  | 'cycle_complete_ok'
  | 'cycle_failed_error'
  | 'door_open_on_start'
  | 'door_locked_overpressure'
  | 'door_fault'
  | 'water_low_warning'
  | 'water_empty_alarm'
  | 'overtemp_overpressure_alarm'
  | 'vacuum_error'
  | 'drain_error'
  | 'sensor_error'
  | 'vacuum_test_passed'
  | 'vacuum_test_failed'
  | 'bowie_dick_test_passed'
  | 'bowie_dick_test_failed'
  | 'service_due'
  | 'gasket_replace_due'
  | 'power_restored'
  | 'config_error';

type AudioNotificationConfig = {
  text: string;
  category: string;
  severity: 'info' | 'success' | 'warning' | 'alarm';
  file?: string;
};

const makePath = (...segments: string[]) =>
  '/soundpack/' + segments.map((segment) => encodeURIComponent(segment)).join('/');

export const AUDIO_NOTIFICATIONS: Record<AudioNotificationId, AudioNotificationConfig> = {
  system_ready: {
    text: 'Аппарат готов к работе.',
    category: 'system',
    severity: 'info',
    file: makePath('system_status', 'аппарат_готов_к_работе.mp3'),
  },
  cycle_start: {
    text: 'Стерилизация начата.',
    category: 'cycle',
    severity: 'info',
    file: makePath('programs_cicles', 'Стерилизация начата..mp3'),
  },
  cycle_complete_ok: {
    text: 'Стерилизация завершена успешно.',
    category: 'cycle',
    severity: 'success',
    file: makePath('programs_cicles', 'Стерилизация завершена успешно.mp3'),
  },
  cycle_failed_error: {
    text: 'Стерилизация прервана из-за ошибки.',
    category: 'cycle',
    severity: 'alarm',
    file: makePath('programs_cicles', 'Стерилизация прервана из-за ошибки. Проверьте сообщения на экране..mp3'),
  },
  door_open_on_start: {
    text: 'Невозможно запустить цикл. Дверь открыта.',
    category: 'door',
    severity: 'warning',
    file: makePath('door', 'Невозможно запустить цикл. Дверь камеры открыта..mp3'),
  },
  door_locked_overpressure: {
    text: 'Дверь заблокирована. В камере ещё есть давление.',
    category: 'door',
    severity: 'info',
    file: makePath('door', 'Дверь заблокирована. В камере ещё есть давление..mp3'),
  },
  door_fault: {
    text: 'Неисправность двери.',
    category: 'door',
    severity: 'alarm',
    file: makePath('door', 'Неисправность двери. Остановите работу и обратитесь к инженеру..mp3'),
  },
  water_low_warning: {
    text: 'Недостаточно воды в парогенераторе.',
    category: 'water',
    severity: 'warning',
    file: makePath('water:steam', 'Недостаточно воды в парогенераторе. Проверьте уровень воды..mp3'),
  },
  water_empty_alarm: {
    text: 'Критическая ошибка. Нет воды в парогенераторе.',
    category: 'water',
    severity: 'alarm',
    file: makePath('water:steam', 'Критическая ошибка. Нет воды в парогенераторе..mp3'),
  },
  overtemp_overpressure_alarm: {
    text: 'Авария. Превышены температура или давление.',
    category: 'safety',
    severity: 'alarm',
    file: makePath('security', 'Авария. Превышены допустимые температура или давление..mp3'),
  },
  vacuum_error: {
    text: 'Ошибка вакуума.',
    category: 'vacuum',
    severity: 'alarm',
  },
  drain_error: {
    text: 'Ошибка слива.',
    category: 'water',
    severity: 'warning',
    file: makePath('water:steam', 'Ошибка слива. Проверьте дренаж и фильтры..mp3'),
  },
  sensor_error: {
    text: 'Неисправность датчика.',
    category: 'sensor',
    severity: 'alarm',
  },
  vacuum_test_passed: {
    text: 'Вакуум-тест пройден.',
    category: 'test',
    severity: 'success',
  },
  vacuum_test_failed: {
    text: 'Вакуум-тест не пройден.',
    category: 'test',
    severity: 'warning',
  },
  bowie_dick_test_passed: {
    text: 'Тест Боуи–Дика пройден.',
    category: 'test',
    severity: 'success',
  },
  bowie_dick_test_failed: {
    text: 'Тест Боуи–Дика не пройден.',
    category: 'test',
    severity: 'warning',
  },
  service_due: {
    text: 'Требуется обслуживание стерилизатора.',
    category: 'service',
    severity: 'warning',
  },
  gasket_replace_due: {
    text: 'Требуется замена дверного уплотнения.',
    category: 'service',
    severity: 'warning',
  },
  power_restored: {
    text: 'Питание восстановлено.',
    category: 'system',
    severity: 'warning',
    file: makePath('system_status', 'Питание восстановлено. Проверьте состояние текущего цикла..mp3'),
  },
  config_error: {
    text: 'Ошибка инициализации. Проверьте настройки системы.',
    category: 'system',
    severity: 'alarm',
    file: makePath('system_status', 'Ошибка инициализации. Проверьте настройки системы.mp3'),
  },
};
