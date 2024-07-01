'use client';

import React, { useContext, useState } from 'react';
import FormLayout from '@/components/form/formLayout';
import { ModalContext } from '@/components/providers/modal-provider';
import TeamRating from './TeamRating';
import { ChevronRight } from 'lucide-react';

const RateContainer: React.FC = () => {
  const { openModal, closeModal } = useContext(ModalContext);
  const nickName = "이쁜이";

  const [clicked, setClicked] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);
  const [memo, setMemo] = useState<string>("");

  const handleMemoChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMemo(event.target.value);
  };

  const handleRating = (index: number): void => {
    let clickStates = clicked.map((_, i) => i <= index);
    setClicked(clickStates);
  };

  const handleSubmit = () => {
    // 별점과 메모를 제출하는 로직을 여기에 추가
    console.log('별점:', clicked);
    console.log('메모:', memo);
    closeModal();
  };

  const handleSkip = () => {
    closeModal();
  };

  const handleClick = () => {
    openModal(
      <FormLayout className='relative h-full px-[204px] pt-[90px] pb-[85px] flex flex-col items-center'>
        <FormLayout.Legend title='팀원 평가' />
        <div className='flex justify-center mb-4'>
          <img
            src="https://via.placeholder.com/400"
            alt="팀원 프로필"
            className="w-24 h-24 rounded-full"
          />
        </div>
        <p className="text-center mb-4">{nickName}님의 게임 매너는 어떤가요?</p>
        <TeamRating clicked={clicked} onStarClick={handleRating} />
        <textarea
            value={memo}
            onChange={handleMemoChange}
            placeholder="메모"
            className="mt-4 p-2 w-full h-32 box-border flex flex-row justify-between items-start gap-10 bg-[rgba(255,255,255,0.5)] border border-white shadow-[0px_4px_10px_rgba(37,73,150,0.1)] rounded-[10px] resize-none" 
        />
        <div className="w-full flex flex-col items-center mt-4">
          <button 
            onClick={handleSubmit} 
            className="h-[46px] w-full bg-black text-white rounded-full mb-2"
          >
            확인
          </button>
          <button 
            onClick={handleSkip} 
            className="flex items-center text-white text-[16px] font-normal leading-[27px]"
          >
            <ChevronRight size={16} className="mr-2" />
            건너뛰기
          </button>
        </div>

      </FormLayout>
    );
  };

  return (
    <button type="button" onClick={handleClick} className="px-4 py-2 bg-blue-500 text-white rounded-lg">
      열림
    </button>
  );
};

export default RateContainer;
