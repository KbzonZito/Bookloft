// Conectar la IA con la API key del propio usuario. La key queda en el Keystore del teléfono.
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useI18n, type MessageKey } from '../i18n';
import { AiError, getApiKey, setApiKey, testApiKey } from '../sources/ai';
import { fade } from '../ui/motion';

type State =
  | { step: 'loading' }
  | { step: 'off' }
  | { step: 'editing'; key: string; testing: boolean; error: string | null }
  | { step: 'on'; masked: string };

const mask = (key: string) => `${key.slice(0, 10)}…${key.slice(-4)}`;

export function AiSettings({ startEditing = false }: { startEditing?: boolean }) {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ step: 'loading' });

  useEffect(() => {
    void getApiKey().then((key) =>
      setState(
        key
          ? { step: 'on', masked: mask(key) }
          : startEditing
            ? { step: 'editing', key: '', testing: false, error: null }
            : { step: 'off' },
      ),
    );
  }, []);

  async function save(key: string) {
    setState({ step: 'editing', key, testing: true, error: null });
    try {
      await testApiKey(key.trim());
      await setApiKey(key.trim());
      setState({ step: 'on', masked: mask(key.trim()) });
    } catch (e) {
      const kind = e instanceof AiError ? e.kind : 'other';
      setState({ step: 'editing', key, testing: false, error: `ai.error.${kind}` });
    }
  }

  return (
    <section className="ai-settings">
      <h2 className="detail-label">{t('ai.title')}</h2>
      <p className="hint">{t('ai.explain')}</p>

      {state.step === 'off' && (
        <button
          className="button"
          onClick={() => setState({ step: 'editing', key: '', testing: false, error: null })}
        >
          {t('ai.connect')}
        </button>
      )}

      {state.step === 'on' && (
        <div className="ai-on">
          <span className="ai-status">{t('ai.connected', { key: state.masked })}</span>
          <button
            className="button danger"
            onClick={() => void setApiKey(null).then(() => setState({ step: 'off' }))}
          >
            {t('ai.disconnect')}
          </button>
        </div>
      )}

      {state.step === 'editing' && (
        <motion.form
          className="ai-form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade}
          onSubmit={(e) => {
            e.preventDefault();
            if (state.key.trim()) void save(state.key);
          }}
        >
          <ol className="ai-steps">
            <li>
              {t('ai.step1')}{' '}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
              >
                console.anthropic.com
              </a>
            </li>
            <li>{t('ai.step2')}</li>
            <li>{t('ai.step3')}</li>
          </ol>
          <input
            className="field"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-…"
            aria-label={t('ai.keyLabel')}
            value={state.key}
            onChange={(e) => setState({ ...state, key: e.target.value, error: null })}
          />
          {state.error && <p className="inbox-error">{t(state.error as MessageKey)}</p>}
          <p className="hint">{t('ai.cost')}</p>
          <button className="button primary" disabled={!state.key.trim() || state.testing}>
            {state.testing ? t('ai.testing') : t('ai.save')}
          </button>
        </motion.form>
      )}
    </section>
  );
}
