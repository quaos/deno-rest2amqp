// TODO: Replace these with lodash or some other libraries

export function merge<T>(target: T, source: Partial<T>): void {
  Object.assign(target, definedProps(source));
}

export function definedProps<T>(obj: T) {
  return Object.fromEntries(
    Object.entries(obj).filter(([k, v]) => v !== undefined)
  );
}

export function setProperty<T>(target: T, path: string, value: any): T {
  if ((typeof target === "undefined") || (target === null)) {
    throw new Error("Invalid Target");
  }
  let currentObj: any = target;
  const pathSegs = path.split(".");
  pathSegs.forEach((key, idx) => {
    if (idx >= pathSegs.length - 1) {
      currentObj[key] = value;
      return;
    }
    if ((typeof currentObj[key] !== "undefined") && (currentObj[key] !== null)) {
      currentObj = currentObj[key];
    } else {
      const newObj = currentObj[key] = {};
      currentObj = newObj;
    }
  });

  return target;
}