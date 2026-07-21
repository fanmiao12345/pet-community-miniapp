declare const wx: any;
declare function Page(options: any): void;
declare function Component(options: any): void;
declare function App<T = any>(options: any): void;
declare function getApp<T = any>(): T;
declare function getCurrentPages(): any[];

declare namespace WechatMiniprogram {
  interface TouchEvent {
    currentTarget: { dataset: Record<string, any> };
    target?: { dataset: Record<string, any> };
    detail?: any;
  }
  interface Input {
    detail: { value: string };
    currentTarget?: { dataset: Record<string, any> };
  }
  interface PickerChange {
    detail: { value: string | string[] };
    currentTarget?: { dataset: Record<string, any> };
  }
  interface CustomEvent<T = any> {
    detail: T;
    currentTarget: { dataset: Record<string, any> };
  }
}
