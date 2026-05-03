import { Download, KeyRound } from "lucide-react";

export function KeysPage() {
  return (
    <div className="page">
      <div className="page-header-row">
        <h1 className="page-title">Ключи</h1>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            /* TODO: запустить скрипт получения ключей */
          }}
        >
          <Download size={14} strokeWidth={2} />
          <span>Получить ключи</span>
        </button>
      </div>
      <div className="page-body">
        <div className="empty-state">
          <div className="empty-state-icon">
            <KeyRound size={22} strokeWidth={1.5} />
          </div>
          <h2>Тут будут твои ключи</h2>
          <p>
            Нажми «Получить ключи» — скрипт подтянет токены и сложит их сюда.
            Дальше каждый ключ можно будет одним кликом подключить как новый таб
            API.
          </p>
        </div>
      </div>
    </div>
  );
}
