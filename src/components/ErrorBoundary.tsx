import * as React from 'react';

interface Props {
  children?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-8">
          <div className="max-w-2xl w-full bg-white p-12 rounded-3xl border-2 border-[#141414] shadow-2xl space-y-6">
            <h1 className="text-4xl font-serif italic text-red-600">Algo salió mal</h1>
            <p className="text-lg font-medium opacity-70">
              La aplicación encontró un error inesperado al iniciarse.
            </p>
            
            <div className="bg-red-50 p-6 rounded-2xl border border-red-200 space-y-4">
              <p className="font-bold text-red-800 uppercase tracking-widest text-xs">Detalles del Error:</p>
              <pre className="text-xs font-mono bg-white p-4 rounded-xl border border-red-100 overflow-auto max-h-60 text-red-600 whitespace-pre-wrap">
                {this.state.error?.stack}
              </pre>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => window.location.reload()}
                className="flex-1 bg-[#141414] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-black transition-all"
              >
                Reintentar
              </button>
              <button 
                onClick={() => {
                  try {
                    localStorage.clear();
                  } catch (e) {}
                  window.location.reload();
                }}
                className="flex-1 border-2 border-[#141414] py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-gray-100 transition-all"
              >
                Limpiar datos locales
              </button>
            </div>
            
            <p className="text-[10px] text-center opacity-40 font-bold uppercase tracking-tighter">
              Si el problema persiste, contacte al soporte técnico con la captura de pantalla de este error.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
