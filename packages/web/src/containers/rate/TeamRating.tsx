import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface RatingProps {
  clicked: boolean[];
  onStarClick: (index: number) => void;
}

const TeamRating: React.FC<RatingProps> = ({ clicked, onStarClick }) => {
  const [hoverIndex, setHoverIndex] = useState(0);
  const starArray = [0, 1, 2, 3, 4];

  const handleMouseEnter = (index: number) => {
    setHoverIndex(index);
  };

  const handleMouseLeave = () => {
    setHoverIndex(-1);
  };

  return (
    <div className="flex pt-1">
      {starArray.map((index) => (
        <Star
          size={40}
          key={index}
          onMouseEnter={() => handleMouseEnter(index)}
          onMouseLeave={handleMouseLeave}
          onClick={() => onStarClick(index)}
          className={`cursor-pointer ${index <= hoverIndex || clicked[index] ? 'text-yellow-500 fill-current' : 'text-gray-400'}`}
          fill={index <= hoverIndex || clicked[index] ? "currentColor" : "none"}
        />
      ))}
    </div>
  );
};

export default TeamRating;
