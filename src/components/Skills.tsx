import type { JSX } from "react";
import { skillGroups } from "../data/skills";
import styles from "../styles/home.module.scss";

export function Skills(): JSX.Element {
  return (
    <section aria-labelledby="skills-heading" className={styles.skills}>
      <h2 id="skills-heading">Skills</h2>
      {skillGroups.map((group) => (
        <div className={styles.skillGroup} key={group.name}>
          <h3>{group.name}</h3>
          <ul className={styles.tags}>
            {group.skills.map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
