// Hoja que sube desde abajo en el teléfono (y se cierra arrastrándola) o un diálogo centrado en tablet
import { X } from 'lucide-react';
import { motion, useDragControls, useIsPresent, type PanInfo } from 'motion/react';
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useBack } from '../app/native';
import { fade, spring } from '../ui/motion';

export function Sheet({
  label,
  onClose,
  header,
  children,
  className = '',
  style,
  variant = 'rise',
  closeLabel,
}: {
  label: string;
  onClose: () => void;
  /** Zona desde la que se puede arrastrar para cerrar (además de la manija) */
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /**
   * rise: la hoja entera sube y aparece.
   * stage: solo el fondo aparece; el contenido anima por su cuenta (la portada que vuela no se desvanece).
   */
  variant?: 'rise' | 'stage';
  /** Con un texto, muestra una X para cerrar (además de arrastrar, tocar afuera o atrás) */
  closeLabel?: string;
}) {
  const controls = useDragControls();
  // Mientras se cierra (la animación de salida), la hoja ya no está: no atrapa toques ni el botón
  // atrás, y la página de atrás se puede tocar y desplazar al tiro
  const present = useIsPresent();
  useBack(present, onClose);

  useEffect(() => {
    if (!present) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [present]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 550) onClose();
  };

  return (
    <div className="sheet-layer" style={present ? undefined : { pointerEvents: 'none' }}>
      <motion.div
        className="scrim"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={fade}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`sheet ${className}`}
        style={style}
        drag="y"
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.8 }}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
        onDragEnd={onDragEnd}
        {...(variant === 'rise' && {
          initial: { y: '8%', opacity: 0 },
          animate: { y: 0, opacity: 1 },
          exit: { y: '6%', opacity: 0, transition: fade },
          transition: spring.sheet,
        })}
      >
        {variant === 'stage' && (
          <motion.div
            className="sheet-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
          />
        )}
        {closeLabel && (
          <motion.button
            className="icon-button sheet-close"
            onClick={onClose}
            aria-label={closeLabel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={fade}
          >
            <X size={20} strokeWidth={1.75} />
          </motion.button>
        )}
        {/* El desplazamiento va por dentro: así el fondo (y su tinte) cubre siempre toda la hoja */}
        <div className="sheet-scroll">
          <div className="sheet-drag" onPointerDown={(e) => controls.start(e)}>
            <div className="grab" aria-hidden />
            {header}
          </div>
          <div className="sheet-body">{children}</div>
        </div>
      </motion.div>
    </div>
  );
}
