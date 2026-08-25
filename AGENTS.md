# Skills Repository Instructions

## Scope

Keep this repository limited to skills owned and maintained here. Link to or
install third-party skills from their original repositories instead of copying
them into this repository.

## Structure

- Place each installable skill in a leaf directory whose name matches the
  `name` in its `SKILL.md` frontmatter.
- Keep category directories, including `skills/boundary-model/`, free of a
  `SKILL.md` so discovery continues into their child directories.
- Keep human-facing documentation at the repository or category level. Keep
  only agent instructions and necessary resources inside a skill directory.

## Editing skills

- Keep instructions portable across target repositories. Resolve project
  conventions from the target repository rather than assuming them here.
- Use only `name` and `description` in `SKILL.md` frontmatter.
- Write instructions in imperative form and keep trigger conditions in the
  frontmatter description.
- Link bundled references directly from `SKILL.md` with relative paths.
- Validate every changed skill before committing it.
