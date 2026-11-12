/** Minimal flag parser. Every data-changing script is a dry run unless --apply is passed. */
export interface Args {
  apply: boolean;
  dryRun: boolean;
  revert?: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

export function parseArgs(argv = process.argv.slice(2)): Args {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split('=', 2);
      if (inline !== undefined) flags[key] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) { flags[key] = argv[i + 1]; i += 1; }
      else flags[key] = true;
    } else positional.push(arg);
  }
  const apply = flags.apply === true;
  if (apply && flags['dry-run']) throw new Error('Use either --apply or --dry-run, not both.');
  return { apply, dryRun: !apply, revert: typeof flags.revert === 'string' ? flags.revert : undefined, flags, positional };
}

export function flagString(args: Args, name: string): string | undefined {
  const v = args.flags[name];
  return typeof v === 'string' ? v : undefined;
}
