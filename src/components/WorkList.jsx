import React from 'react'
import WorkItem from './WorkItem'

class WorkList extends React.Component {
  constructor() {
    super();
  }

  render() {
    let { items } = this.props;

    return (
        <div className='works'>
          {items.map((item) => (
            <WorkItem
              key={item.title}
              title={item.title}
              slug={item.fields.slug}
              url={item.url}
            />
          ))}
        </div>
    );
  }
}

export default WorkList;
