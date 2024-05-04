    const slider = document.getElementById('slider');
    const sliderWrapper = document.getElementById('slider-wrapper');
    const sliderNav = document.getElementById('slider-nav')
    let currentIndex = 0;
    const slides = slider.querySelectorAll('img');
    const totalSlides = slides.length;
    let interval;

    function nextSlide() {
        currentIndex = (currentIndex + 1) % totalSlides;
        slider.scrollLeft = sliderWrapper.offsetWidth * currentIndex;
    }

    interval = setInterval(nextSlide, 3000);
    sliderNav.addEventListener('mouseenter', () => clearInterval(interval));
    sliderNav.addEventListener('mouseleave', () => {
        interval = setInterval(nextSlide, 3000);
    });

    document.addEventListener('DOMContentLoaded', function() {
        const slider = document.getElementById('slider');
        const nav1 = document.getElementById('Nav1');
        const nav2 = document.getElementById('Nav2');
        const nav3 = document.getElementById('Nav3');
        
       
        slider.addEventListener('scroll', function() {
            const currentSlide = Array.from(slider.children).find(child => child.getBoundingClientRect().left >= 0);
         
            const currentSlideId = currentSlide.id;

            nav1.style.opacity = 0.25;
            nav2.style.opacity = 0.25;
            nav3.style.opacity = 0.25;

            
            if (currentSlideId === 'Slider1') {
              
                nav1.style.opacity = 1;
            }
            else if (currentSlideId === 'Slider2'){
                nav2.style.opacity = 1;
            }
            else if (currentSlideId === 'Slider3'){
                nav3.style.opacity = 1;
            }
            
        });
    });
