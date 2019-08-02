const duration = 500
  
const state = (status, isBackward) => {
  const styles = {
    entering: {
      position: "absolute",
      opacity: 0,
      marginLeft: isBackward ? "-50vw" : "50vw",
      marginRight: isBackward ? "50vw" : "-50vw",
    },
    entered: {
      opacity: 1,
      marginLeft: 0,
      marginRight: 0,
      transition: `opacity ${duration}ms ease-out, margin-left ${duration}ms ease-out, margin-right ${duration}ms ease-out`,
    },
    exiting: {
      opacity: 0,
      marginLeft: isBackward ? "50vw" : "-50vw",
      marginRight: isBackward ? "-50vw" : "50vw",
      transition: `opacity ${duration}ms ease-in, margin-left ${duration}ms ease-in, margin-right ${duration}ms ease-in`,
    },
  };
  return styles[status]
};

export { duration, state}