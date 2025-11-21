type ErrorInfo = {
  title: string;
  operatorAction: string[];
  tone?: 'danger' | 'warning';
  icon?: 'water' | 'temp' | 'pressure' | 'vacuum' | 'door' | 'power' | 'sensor';
};

export const ERROR_MAP: Record<string, ErrorInfo> = {
  HEATING_TIMEOUT: {
    title: 'Не удалось достичь температуры стерилизации',
    operatorAction: [
      'Проверьте загрузку камеры (не перегружена ли)',
      'Повторите цикл, при повторении вызовите сервис',
    ],
  },
  OVERPRESSURE: {
    title: 'Избыточное давление в камере',
    operatorAction: [
      'Не открывайте дверь до снятия аварии',
      'Дождитесь сброса давления',
      'Сообщите сервисному инженеру',
    ],
    tone: 'danger',
    icon: 'pressure',
  },
  OVERTEMP: {
    title: 'Превышение температуры',
    operatorAction: ['Дождитесь остановки цикла', 'Сообщите сервису'],
    tone: 'danger',
    icon: 'temp',
  },
  NO_WATER: {
    title: 'Недостаточно воды в парогенераторе',
    operatorAction: ['Проверьте подачу воды', 'Заполните систему'],
    tone: 'warning',
    icon: 'water',
  },
  VACUUM_FAIL: {
    title: 'Не удалось достичь вакуума',
    operatorAction: ['Проверьте, плотно ли закрыта дверь', 'При повторении сообщите сервису'],
    tone: 'warning',
    icon: 'vacuum',
  },
  SENSOR_FAILURE: {
    title: 'Ошибка датчика',
    operatorAction: ['Остановите использование, вызовите сервис для проверки датчиков и калибровки'],
    tone: 'warning',
    icon: 'sensor',
  },
  DOOR_OPEN: {
    title: 'Дверь открыта / не заблокирована',
    operatorAction: ['Закройте дверь и убедитесь в надёжной блокировке'],
    tone: 'warning',
    icon: 'door',
  },
  POWER_ERROR: {
    title: 'Ошибка питания',
    operatorAction: ['Проверьте наличие питания', 'При повторении сообщите сервису'],
    tone: 'warning',
    icon: 'power',
  },
};
