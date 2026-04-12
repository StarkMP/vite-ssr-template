export type ServerSideRenderingSetup = {
  getTemplate: (url: string) => Promise<string>;
  renderApp: (url: string) => Promise<string>;
  getCached?: (url: string) => string | undefined;
  processHtml?: (url: string, html: string) => Promise<string>;
  fixStacktrace?: (error: Error) => void;
};
