import { useCallback } from 'preact/hooks';
import { context } from './context';
import { COMMANDS } from '../plugins/speech';

function normalizeNumber(time) {
  return time < 10 ? `0${time}` : `${time}`;
}

function formatTime(time = 0) {
  if (time === 0) {
    return '00:00';
  }

  time = time / 1000;
  const minutes = Math.floor(time / 60);
  const seconds = Math.min(59, Math.round(time - minutes * 60));

  return `${normalizeNumber(minutes)}:${normalizeNumber(seconds)}`;
}

function Player({ widget }) {
  const { playing, open, debug } = widget.state;

  const defaultButton = {
    fontFamily: 'Georgia, serif',
    padding: '4px',
    border: '1px solid lightgray',
    textAlign: 'center',
    fontSize: '24px',
    lineHeight: '24px',
    margin: '0px 4px',
    minWidth: '24px',
    display: 'inline-block',
    borderRadius: '4px',
    color: 'darkgray',
  };

  const playButton = {
    backgroundColor: 'forestgreen',
    color: 'white',
    fontSize: '24px',
  };

  const timeStyle = {
    fontFamily: 'serif',
    fontSize: '14px',
    textAlign: 'center',
    padding: '0 0 4px 0',
  };

  const openButton = {
    fontSize: '10px',
    position: 'absolute',
    right: '-18px',
    top: '-16px',
    padding: '8px',
  };

  const logButton = {
    fontSize: '10px',
    position: 'absolute',
    left: '-18px',
    top: '-16px',
    padding: '8px',
    maxWidget: '320px',
  };

  const onMouseOver = useCallback((event) => {
    event.target.style.color = 'black';
    event.target.style.border = '1px solid darkgray';
  }, []);
  const onMouseOut = useCallback((event) => {
    if (event.target.style.backgroundColor === 'forestgreen') {
      event.target.style.color = 'white';
    } else {
      event.target.style.color = 'darkgray';
    }

    event.target.style.border = '1px solid lightgray';
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={openButton}
        onClick={() => widget.setState({ open: !widget.state.open })}
      >
        {' '}
        {widget.state.open ? '{}' : '{ }'}
      </div>
      <div
        style={logButton}
        onClick={() => widget.setState({ debug: !widget.state.debug })}
      >
        {' '}
        {widget.state.debug ? '[]' : '[ ]'}
      </div>
      {debug && (
        <div>
          <pre>
            {JSON.stringify(
              {
                ...widget.state,
                version: widget.version,
                texts: widget.state.texts.length,
                allReadingTime: widget?.getReadingTime?.(
                  widget.state.texts.join('')
                ),
                blockReadingTime: widget?.getReadingTime?.(
                  widget.state.texts[widget.state.textIndex]
                ),
                speaking: window.speechSynthesis.speaking,
                events: widget.$external.events.slice(
                  10 > widget.$external.events.length
                    ? 0
                    : widget.$external.events.length - 10,
                  widget.$external.events.length
                ),
                voice: widget.$external.voice.lang,
              },
              0,
              4
            )}
          </pre>
        </div>
      )}
      <div style={timeStyle}>{formatTime(widget?.getTimeRemaining?.())}</div>
      <div>
        {/* {open && (
          <div
            style={{ ...defaultButton }}
            onClick={onPrevious}
            onMouseOver={onMouseOver}
            onMouseOut={onMouseOut}
          >
            {'|<'}
          </div>
        )} */}
        {!playing && (
          <div
            style={{
              ...defaultButton,
              ...playButton,
            }}
            onClick={() => widget.emit(COMMANDS.PLAY)}
            onMouseOver={onMouseOver}
            onMouseOut={onMouseOut}
          >
            {'>'}
          </div>
        )}
        {playing && (
          <div
            style={{
              ...defaultButton,
              ...playButton,
            }}
            onClick={() => widget.emit(COMMANDS.PAUSE)}
            onMouseOver={onMouseOver}
            onMouseOut={onMouseOut}
          >
            {'||'}
          </div>
        )}
        {/* {open && (
          <div
            style={{ ...defaultButton }}
            onClick={onNext}
            onMouseOver={onMouseOver}
            onMouseOut={onMouseOut}
          >
            {'>|'}
          </div>
        )} */}
        {open && (
          <div
            style={{ ...defaultButton }}
            onClick={() => widget.emit(COMMANDS.CANCEL, true)}
            onMouseOver={onMouseOver}
            onMouseOut={onMouseOut}
          >
            {'x'}
          </div>
        )}
      </div>
    </div>
  );
}

export function Speakable({ widget }) {
  const style = {
    margin: '8px',
    padding: '8px 12px',
    border: '1px solid lightGray',
    borderRadius: '4px',
    backgroundColor: widget.state.error ? 'lightyellow' : 'white',
  };
  return (
    <context.Provider value={widget}>
      <div style={style}>
        <Player widget={widget} />
      </div>
    </context.Provider>
  );
}
