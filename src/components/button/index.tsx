import styles from './button.module.scss';

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
};

export const Button = ({ children, onClick }: ButtonProps) => (
  <button className={styles.button} onClick={onClick}>
    {children}
  </button>
);
