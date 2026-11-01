import React from 'react';

/**
 * The ONE place that knows which icon font is used.
 *
 *  - Material Symbols (recommended):  FONT_CLASS = 'material-symbols-outlined'
 *      npm i material-symbols     →  import 'material-symbols/outlined.css'   (in main.tsx)
 *  - Classic Material Icons:          FONT_CLASS = 'material-icons'
 *      npm i material-icons       →  import 'material-icons/iconfont/material-icons.css'
 *
 * `name` is the ligature name, e.g. <Icon name="content_copy" />.
 * Until the font CSS is loaded the box is clipped to size, so raw ligature text never spills out.
 */
const FONT_CLASS = 'material-symbols-outlined';

export function Icon({
  name,
  size = 18,
  fill = false,
  className = '',
}: {
  name: string;
  size?: number;
  /** Filled variant (Material Symbols only). */
  fill?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`${FONT_CLASS} inline-block shrink-0 overflow-hidden select-none leading-none ${className}`}
      style={{
        fontSize: size,
        width: size,
        height: size,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
    >
      {name}
    </span>
  );
}
